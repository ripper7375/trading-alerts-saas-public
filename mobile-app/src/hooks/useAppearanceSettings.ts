import { useState, useEffect, useCallback } from 'react';

export type AccentColor = 'amber' | 'emerald' | 'blue' | 'purple';
export type CandleTheme = 'traditional' | 'modern' | 'monochrome';

export interface AppearanceSettings {
  accentColor: AccentColor;
  candleTheme: CandleTheme;
  reduceMotion: boolean;
  hapticFeedback: boolean;
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  accentColor: 'amber',
  candleTheme: 'traditional',
  reduceMotion: false,
  hapticFeedback: true,
};

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    const saved = localStorage.getItem('davintrade_appearance');
    return saved
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('davintrade_appearance', JSON.stringify(settings));
    document.documentElement.setAttribute('data-accent', settings.accentColor);
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof AppearanceSettings>(
      key: K,
      value: AppearanceSettings[K]
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return {
    settings,
    updateSetting,
    setAccentColor: (color: AccentColor) => updateSetting('accentColor', color),
    setCandleTheme: (theme: CandleTheme) => updateSetting('candleTheme', theme),
  };
}
