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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';
import { useTheme } from 'next-themes';
import { useAppearance } from '@/components/providers/appearance-provider';
import {
  ThemeMode,
  AccentScheme,
  DEFAULT_APPEARANCE_SETTINGS,
} from '@/lib/appearance/types';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface AccentOption {
  name: AccentScheme;
  label: string;
  colorClass: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'dark',
    label: 'Dark Trading Terminal',
    icon: Moon,
    description: 'High-contrast dark theme optimized for long trading sessions',
  },
  {
    value: 'light',
    label: 'Light Clean Mode',
    icon: Sun,
    description: 'Bright high-visibility interface for daylight analysis',
  },
  {
    value: 'system',
    label: 'System Sync',
    icon: Monitor,
    description: 'Automatically match your operating system theme settings',
  },
];

const accentOptions: AccentOption[] = [
  { name: 'amber', label: 'Gold Amber', colorClass: 'bg-amber-500' },
  { name: 'emerald', label: 'Emerald Green', colorClass: 'bg-emerald-500' },
  { name: 'blue', label: 'Sapphire Blue', colorClass: 'bg-blue-500' },
  { name: 'purple', label: 'Amethyst Purple', colorClass: 'bg-purple-500' },
];

const accentActiveStyles: Record<AccentScheme, string> = {
  amber:
    'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  emerald:
    'border-emerald-500 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  blue: 'border-blue-500 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30',
  purple:
    'border-purple-500 bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30',
};

export function AppearanceForm() {
  const { t } = useLocale();
  const { setTheme } = useTheme();
  const { settings, updateSettings, saveSettings, isSaving } = useAppearance();
  const [isSaved, setIsSaved] = useState(false);

  const handleThemeChange = (newTheme: ThemeMode) => {
    updateSettings({ theme: newTheme });
    setTheme(newTheme);
  };

  const handleResetChartDefaults = () => {
    updateSettings({
      chartUpColor: DEFAULT_APPEARANCE_SETTINGS.chartUpColor,
      chartDownColor: DEFAULT_APPEARANCE_SETTINGS.chartDownColor,
      gridOpacity: DEFAULT_APPEARANCE_SETTINGS.gridOpacity,
    });
  };

  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <Palette className="h-4 w-4 text-amber-400" />{' '}
              {t('Terminal Appearance & Chart Color Scheme')}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Customise dark trading themes, accent highlights, and candlestick styles'
              )}
            </p>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
            {t('LIVE PREVIEW')}
          </Badge>
        </div>

        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Theme Mode')}
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
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 shadow-md ring-1 ring-amber-500/30'
                      : 'border-slate-800 bg-[#06080e] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  )}
                >
                  <div className="flex w-full items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-amber-400" />{' '}
                      {t(
                        option.label,
                        option.label === 'Dark Trading Terminal'
                          ? 'Dark Trading Terminal'
                          : option.label === 'Light Clean Mode'
                            ? 'Clean Light Mode'
                            : 'System Synchronized'
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-amber-400" />}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    {t(
                      option.description,
                      option.label === 'Dark Trading Terminal'
                        ? 'High-contrast dark theme optimized for long trading sessions'
                        : option.label === 'Light Clean Mode'
                          ? 'Crisp light interface for daytime analysis'
                          : 'Automatically adapts to operating system preferences'
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* Accent Color Scheme */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Accent Color Scheme')}
          </Label>
          <div className="flex items-center gap-3">
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
                      ? accentActiveStyles[opt.name]
                      : 'border-slate-800 bg-[#06080e] text-slate-400 hover:text-slate-200'
                  )}
                >
                  <span
                    className={cn('h-3.5 w-3.5 rounded-full', opt.colorClass)}
                  />
                  <span>
                    {t(
                      opt.label,
                      opt.name === 'amber'
                        ? 'Amber Gold'
                        : opt.name === 'emerald'
                          ? 'Emerald Green'
                          : opt.name === 'blue'
                            ? 'Sapphire Blue'
                            : 'Amethyst Purple'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* Chart Preferences */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Chart Candlestick & Grid Customization')}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetChartDefaults}
              className="h-7 gap-1.5 border-slate-700 bg-slate-800/80 px-2.5 text-[11px] font-bold text-slate-300 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
              title={t(
                'Reset chart candlestick colors and grid opacity to defaults'
              )}
            >
              <RotateCcw className="h-3 w-3 text-amber-400" />
              {t('Reset Defaults')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
              <span className="text-xs font-medium text-slate-300">
                {t('Bullish Up Candle')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.chartUpColor}
                  onChange={(e) =>
                    updateSettings({ chartUpColor: e.target.value })
                  }
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                />
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: settings.chartUpColor }}
                >
                  {settings.chartUpColor}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
              <span className="text-xs font-medium text-slate-300">
                {t('Bearish Down Candle')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.chartDownColor}
                  onChange={(e) =>
                    updateSettings({ chartDownColor: e.target.value })
                  }
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
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

          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">{t('Chart Grid Opacity')}</span>
              <span className="font-mono text-amber-300">
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
              className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-amber-500"
            />
          </div>

          {/* Dynamic Live Preview Chart Box */}
          <div className="relative mt-4 h-32 w-full overflow-hidden rounded-xl border border-slate-800 bg-[#04060a] p-4">
            {/* Grid overlay with dynamic opacity */}
            <div
              className="pointer-events-none absolute inset-0 transition-opacity"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: settings.gridOpacity / 100,
              }}
            />

            <div className="relative z-10 flex h-full items-end justify-around px-4">
              {/* Up Candle Sample 1 */}
              <div className="flex flex-col items-center">
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '14px',
                  }}
                />
                <div
                  className="w-4 rounded-sm shadow-sm transition-colors"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '36px',
                  }}
                />
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '10px',
                  }}
                />
              </div>

              {/* Down Candle Sample 1 */}
              <div className="flex flex-col items-center">
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '8px',
                  }}
                />
                <div
                  className="w-4 rounded-sm shadow-sm transition-colors"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '42px',
                  }}
                />
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '16px',
                  }}
                />
              </div>

              {/* Up Candle Sample 2 */}
              <div className="flex flex-col items-center">
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '16px',
                  }}
                />
                <div
                  className="w-4 rounded-sm shadow-sm transition-colors"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '48px',
                  }}
                />
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartUpColor,
                    height: '12px',
                  }}
                />
              </div>

              {/* Down Candle Sample 2 */}
              <div className="flex flex-col items-center">
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '10px',
                  }}
                />
                <div
                  className="w-4 rounded-sm shadow-sm transition-colors"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '28px',
                  }}
                />
                <div
                  className="w-0.5"
                  style={{
                    backgroundColor: settings.chartDownColor,
                    height: '8px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('Saving...')}
              </span>
            ) : isSaved ? (
              t('Preferences Saved!')
            ) : (
              t('Apply Appearance Settings')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
