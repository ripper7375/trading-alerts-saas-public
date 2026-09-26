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

interface AppearanceContextValue {
  settings: AppearanceSettings;
  updateSettings: (newSettings: Partial<AppearanceSettings>) => void;
  /**
   * Persists the current settings, optionally merging `overrides` in first.
   * Passing `overrides` (rather than relying on a prior `updateSettings()`
   * call having already landed in `settings`) sidesteps a stale-closure
   * race: `updateSettings()` schedules a state update but doesn't apply it
   * synchronously, so a caller that does `updateSettings(x); saveSettings()`
   * in the same handler would otherwise persist the settings from BEFORE
   * that update -- exactly the value the caller just asked to change.
   */
  saveSettings: (overrides?: Partial<AppearanceSettings>) => Promise<boolean>;
  isSaving: boolean;
  /** settings.theme resolved to an actual light/dark value ('system' resolved via OS preference) -- for canvas-based UI (chart libraries) that can't read CSS custom properties/.dark class and must be told the active theme directly. */
  resolvedTheme: 'light' | 'dark';
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
 * Applies the resolved theme class directly to <html>. AppearanceProvider
 * is the only owner of that class: its settings are server-resolved on
 * every full page load (DB record, else the davintrade-appearance cookie)
 * and persisted via saveAppearanceAction, and the root layout's inline
 * script paints the same server value before hydration. next-themes is no
 * longer mounted -- it kept a second, localStorage-seeded theme and
 * re-applied it after hydration, splitting the page class from
 * `resolvedTheme` consumers (see app/providers.tsx).
 */
function applyThemeToDOM(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveThemeClass(theme);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
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
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveThemeClass(initialSettings.theme)
  );

  // Apply CSS variables/data-accent whenever settings change.
  useEffect(() => {
    applyAppearanceToDOM(settings);
  }, [settings]);

  // Own the .dark/.light class directly (see applyThemeToDOM) --
  // useLayoutEffect so there's no flash between commit and paint when the
  // user picks a new Theme Mode. The class and `resolvedTheme` are set
  // together, from the same value, so they cannot disagree.
  useLayoutEffect(() => {
    applyThemeToDOM(settings.theme);
    setResolvedTheme(resolveThemeClass(settings.theme));
  }, [settings.theme]);

  // Keep the DOM in sync with OS-level scheme changes while in 'system' mode.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      applyThemeToDOM('system');
      setResolvedTheme(resolveThemeClass('system'));
    };
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

  const saveSettings = async (
    overrides?: Partial<AppearanceSettings>
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await saveAppearanceAction({ ...settings, ...overrides });
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
        resolvedTheme,
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
  resolvedTheme: 'light' | 'dark';
} {
  const { settings, resolvedTheme } = useAppearance();
  return {
    chartUpColor: settings.chartUpColor,
    chartDownColor: settings.chartDownColor,
    gridOpacity: settings.gridOpacity,
    gridOpacityDecimal: settings.gridOpacity / 100,
    resolvedTheme,
  };
}
