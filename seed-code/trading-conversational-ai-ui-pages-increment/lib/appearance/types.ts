export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentScheme = 'amber' | 'emerald' | 'blue' | 'purple';

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: AccentScheme;
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number; // Percentage 0 - 100
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  accent: 'amber',
  chartUpColor: '#00fbff',
  chartDownColor: '#fb00ff',
  gridOpacity: 0,
};

export const APPEARANCE_COOKIE_NAME = 'davintrade-appearance';
