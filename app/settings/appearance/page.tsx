'use client';

import { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Palette,
  Loader2,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAppearance } from '@/components/providers/appearance-provider';
import {
  AccentScheme,
  DEFAULT_APPEARANCE_SETTINGS,
  ThemeMode,
} from '@/lib/appearance/types';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Appearance Settings Page (Row 74, Protected Page #5)
 *
 * Theme mode, accent color scheme, and candlestick/grid chart
 * customization, backed by lib/appearance (DB + cookie persisted via
 * saveAppearanceAction). Ported unchanged from the pre-existing
 * app/(dashboard)/settings/appearance/page.tsx, which already matches
 * Codebase 2's design intent (oklch design tokens, live preview, 4-scheme
 * accent picker) -- per Decision 5, this page is not rebuilt.
 */

interface ThemeOption {
  value: ThemeMode;
  labelKey: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  descKey: string;
  description: string;
}

interface AccentOption {
  name: AccentScheme;
  labelKey: string;
  label: string;
  swatchClass: string;
  activeClass: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'dark',
    labelKey: 'settings.theme_dark',
    label: 'Dark Trading Terminal',
    icon: Moon,
    descKey: 'settings.theme_dark_desc',
    description: 'High-contrast dark theme optimized for long trading sessions',
  },
  {
    value: 'light',
    labelKey: 'settings.theme_light',
    label: 'Light Clean Mode',
    icon: Sun,
    descKey: 'settings.theme_light_desc',
    description: 'Bright high-visibility interface for daylight analysis',
  },
  {
    value: 'system',
    labelKey: 'settings.theme_system',
    label: 'System Sync',
    icon: Monitor,
    descKey: 'settings.theme_system_desc',
    description: 'Automatically match your operating system theme settings',
  },
];

const accentOptions: AccentOption[] = [
  {
    name: 'amber',
    labelKey: 'settings.accent_amber',
    label: 'Gold Amber',
    swatchClass: 'bg-amber-500',
    activeClass:
      'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30',
  },
  {
    name: 'emerald',
    labelKey: 'settings.accent_emerald',
    label: 'Emerald Green',
    swatchClass: 'bg-emerald-500',
    activeClass:
      'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30',
  },
  {
    name: 'blue',
    labelKey: 'settings.accent_blue',
    label: 'Sapphire Blue',
    swatchClass: 'bg-blue-500',
    activeClass:
      'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/30',
  },
  {
    name: 'purple',
    labelKey: 'settings.accent_purple',
    label: 'Amethyst Purple',
    swatchClass: 'bg-purple-500',
    activeClass:
      'border-purple-500 bg-purple-500/15 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/30',
  },
];

export default function AppearanceSettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const { settings, updateSettings, saveSettings, isSaving } = useAppearance();
  const [isSaved, setIsSaved] = useState(false);

  const handleThemeChange = (newTheme: ThemeMode): void => {
    updateSettings({ theme: newTheme });
  };

  const handleResetChartDefaults = (): void => {
    updateSettings({
      chartUpColor: DEFAULT_APPEARANCE_SETTINGS.chartUpColor,
      chartDownColor: DEFAULT_APPEARANCE_SETTINGS.chartDownColor,
      gridOpacity: DEFAULT_APPEARANCE_SETTINGS.gridOpacity,
    });
  };

  const handleSave = async (): Promise<void> => {
    const success = await saveSettings();
    if (success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Palette className="h-4 w-4 text-primary" />
              {t(
                'settings.terminal_appearance_title',
                'Terminal Appearance & Chart Color Scheme'
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.terminal_appearance_desc',
                'Customize theme mode, accent highlights, and candlestick styles. Changes apply instantly across the app.'
              )}
            </p>
          </div>
          <Badge className="border-primary/40 bg-primary/10 hover:bg-primary/10 border font-mono text-[10px] text-primary">
            {t('settings.live_preview', 'LIVE PREVIEW')}
          </Badge>
        </div>

        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t('settings.theme_mode', 'Theme Mode')}
          </Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeChange(option.value)}
                  className={cn(
                    'flex cursor-pointer flex-col items-start rounded-xl border p-4 text-left transition-all',
                    isSelected
                      ? 'bg-primary/10 ring-primary/30 border-primary text-primary shadow-md ring-1'
                      : 'bg-muted/40 hover:border-primary/40 border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="flex w-full items-center justify-between text-sm font-bold">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {t(option.labelKey, option.label)}
                    </span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t(option.descKey, option.description)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Accent Color Scheme */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t('settings.accent_color_scheme', 'Accent Color Scheme')}
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            {accentOptions.map((opt) => {
              const isSelected = settings.accent === opt.name;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => updateSettings({ accent: opt.name })}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all',
                    isSelected
                      ? opt.activeClass
                      : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span
                    className={cn('h-3.5 w-3.5 rounded-full', opt.swatchClass)}
                  />
                  <span>{t(opt.labelKey, opt.label)}</span>
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Chart Preferences */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t(
                'settings.chart_candlestick_title',
                'Chart Candlestick & Grid Customization'
              )}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetChartDefaults}
              className="h-7 gap-1.5 px-2.5 text-[11px] font-bold"
              title={t(
                'settings.reset_defaults_tooltip',
                'Reset chart candlestick colors and grid opacity to defaults'
              )}
            >
              <RotateCcw className="h-3 w-3" />
              {t('settings.reset_defaults', 'Reset Defaults')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-muted/40 flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-xs font-medium text-foreground">
                {t('settings.bullish_candle', 'Bullish Up Candle')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.chartUpColor}
                  onChange={(e) =>
                    updateSettings({ chartUpColor: e.target.value })
                  }
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                  aria-label={t(
                    'settings.bullish_candle_aria',
                    'Bullish up candle color'
                  )}
                />
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: settings.chartUpColor }}
                >
                  {settings.chartUpColor}
                </span>
              </div>
            </div>

            <div className="bg-muted/40 flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-xs font-medium text-foreground">
                {t('settings.bearish_candle', 'Bearish Down Candle')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.chartDownColor}
                  onChange={(e) =>
                    updateSettings({ chartDownColor: e.target.value })
                  }
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                  aria-label={t(
                    'settings.bearish_candle_aria',
                    'Bearish down candle color'
                  )}
                />
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: settings.chartDownColor }}
                >
                  {settings.chartDownColor}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-muted/40 space-y-2 rounded-xl border border-border p-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-foreground">
                {t('settings.chart_grid_opacity', 'Chart Grid Opacity')}
              </span>
              <span className="font-mono text-primary">
                {settings.gridOpacity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.gridOpacity}
              onChange={(e) =>
                updateSettings({ gridOpacity: parseInt(e.target.value, 10) })
              }
              className="h-1.5 w-full cursor-pointer rounded-lg bg-border accent-primary"
              aria-label={t(
                'settings.chart_grid_opacity',
                'Chart Grid Opacity'
              )}
            />
          </div>

          {/* Live Preview */}
          <div className="relative mt-4 h-32 w-full overflow-hidden rounded-xl border border-border bg-background p-4">
            <div
              className="pointer-events-none absolute inset-0 transition-opacity"
              style={{
                backgroundImage:
                  'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: settings.gridOpacity / 100,
                color: 'oklch(var(--muted-foreground))',
              }}
            />
            <div className="relative z-10 flex h-full items-end justify-around px-4">
              {[
                { color: settings.chartUpColor, h: [14, 36, 10] },
                { color: settings.chartDownColor, h: [8, 42, 16] },
                { color: settings.chartUpColor, h: [16, 48, 12] },
                { color: settings.chartDownColor, h: [10, 28, 8] },
              ].map((candle, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="w-0.5"
                    style={{
                      backgroundColor: candle.color,
                      height: candle.h[0],
                    }}
                  />
                  <div
                    className="w-4 rounded-sm shadow-sm transition-colors"
                    style={{
                      backgroundColor: candle.color,
                      height: candle.h[1],
                    }}
                  />
                  <div
                    className="w-0.5"
                    style={{
                      backgroundColor: candle.color,
                      height: candle.h[2],
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 text-xs font-extrabold"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('Saving...')}
              </span>
            ) : isSaved ? (
              t('Preferences Saved!')
            ) : (
              t('settings.apply_appearance', 'Apply Appearance Settings')
            )}
          </Button>
        </div>
      </div>

      {/* Info Note */}
      <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.appearance_sync_note',
            'Signed-in preferences sync across every browser and device. Signed out, your choices are still remembered on this browser via a cookie.'
          )}
        </p>
      </div>
    </div>
  );
}
