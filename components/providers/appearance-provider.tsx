'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useTheme } from 'next-themes';

import { saveAppearanceAction } from '@/app/actions/appearance';
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
} from '@/lib/appearance/types';

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

export function AppearanceProvider({
  children,
  initialSettings = DEFAULT_APPEARANCE_SETTINGS,
}: {
  children: React.ReactNode;
  initialSettings?: AppearanceSettings;
}): React.ReactElement {
  const [settings, setSettings] = useState<AppearanceSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const { setTheme } = useTheme();

  // Apply CSS variables/data-accent whenever settings change.
  useEffect(() => {
    applyAppearanceToDOM(settings);
  }, [settings]);

  // Reconcile next-themes' own .dark/.light class to our theme setting: once
  // on mount, to point next-themes at the server-resolved (DB/cookie) value
  // (next-themes owns the class toggle and its zero-FOUC inline script), and
  // on every subsequent change so picking a new Theme Mode in the appearance
  // form actually flips the class too — updateSettings() alone only touches
  // our own React state/CSS vars, not next-themes' state.
  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme, setTheme]);

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
