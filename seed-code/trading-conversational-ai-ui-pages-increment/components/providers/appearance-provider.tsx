'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
} from '@/lib/appearance/types';
import { saveAppearanceAction } from '@/app/actions/appearance';

interface AppearanceContextType {
  settings: AppearanceSettings;
  updateSettings: (newSettings: Partial<AppearanceSettings>) => void;
  saveSettings: () => Promise<boolean>;
  isSaving: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(
  undefined
);

/**
 * Apply CSS custom properties dynamically to document element for 60 FPS feedback.
 */
function applyAppearanceToDOM(settings: AppearanceSettings) {
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
}) {
  const [settings, setSettings] = useState<AppearanceSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  // Apply CSS variables whenever settings change
  useEffect(() => {
    applyAppearanceToDOM(settings);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppearanceSettings>) => {
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

/**
 * Main hook to consume and modify appearance preferences.
 */
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}

/**
 * High-performance hook for charting components (TradingView/Canvas/SVG).
 * Allows chart instances to listen to appearance tokens without full DOM re-renders.
 */
export function useChartAppearance() {
  const { settings } = useAppearance();
  return {
    chartUpColor: settings.chartUpColor,
    chartDownColor: settings.chartDownColor,
    gridOpacity: settings.gridOpacity,
    gridOpacityDecimal: settings.gridOpacity / 100,
  };
}
