/**
 * Hybrid Terminal Appearance — shared types and defaults.
 *
 * Source of truth for the Settings > Appearance feature: theme mode, accent
 * color scheme, and candlestick/grid chart customization. Consumed by the
 * server-side resolution hierarchy (lib/appearance/server-appearance.ts),
 * the save Server Action (app/actions/appearance.ts), and the client
 * provider (components/providers/appearance-provider.tsx).
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentScheme = 'amber' | 'emerald' | 'blue' | 'purple';

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: AccentScheme;
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number; // 0 - 100
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'light',
  accent: 'amber',
  chartUpColor: '#00fbff', // Bullish Up Candle (Cyan)
  chartDownColor: '#fb00ff', // Bearish Down Candle (Magenta)
  gridOpacity: 0, // Chart Grid Opacity (0%)
};

export const APPEARANCE_COOKIE_NAME = 'davintrade-appearance';

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];
const ACCENT_SCHEMES: readonly AccentScheme[] = [
  'amber',
  'emerald',
  'blue',
  'purple',
];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates and clamps an arbitrary (untrusted) value into a safe
 * AppearanceSettings object, falling back to DEFAULT_APPEARANCE_SETTINGS
 * per-field for anything malformed. Used at every boundary that accepts
 * client- or cookie-supplied input (Server Action, cookie parsing).
 */
export function sanitizeAppearanceSettings(input: unknown): AppearanceSettings {
  const value = (input ?? {}) as Partial<
    Record<keyof AppearanceSettings, unknown>
  >;

  const theme: ThemeMode = THEME_MODES.includes(value.theme as ThemeMode)
    ? (value.theme as ThemeMode)
    : DEFAULT_APPEARANCE_SETTINGS.theme;

  const accent: AccentScheme = ACCENT_SCHEMES.includes(
    value.accent as AccentScheme
  )
    ? (value.accent as AccentScheme)
    : DEFAULT_APPEARANCE_SETTINGS.accent;

  const chartUpColor =
    typeof value.chartUpColor === 'string' &&
    HEX_COLOR_RE.test(value.chartUpColor)
      ? value.chartUpColor
      : DEFAULT_APPEARANCE_SETTINGS.chartUpColor;

  const chartDownColor =
    typeof value.chartDownColor === 'string' &&
    HEX_COLOR_RE.test(value.chartDownColor)
      ? value.chartDownColor
      : DEFAULT_APPEARANCE_SETTINGS.chartDownColor;

  const gridOpacityRaw = value.gridOpacity;
  const gridOpacity =
    typeof gridOpacityRaw === 'number' && Number.isFinite(gridOpacityRaw)
      ? Math.min(100, Math.max(0, Math.round(gridOpacityRaw)))
      : DEFAULT_APPEARANCE_SETTINGS.gridOpacity;

  return { theme, accent, chartUpColor, chartDownColor, gridOpacity };
}
