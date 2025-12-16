'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/providers/theme-provider';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Appearance Settings Page
 *
 * Features:
 * - Theme selection: Light, Dark, System
 * - Color scheme selector
 * - Chart preferences (candlestick colors, grid opacity)
 * - Changes apply immediately (no save button needed)
 */

type Theme = 'light' | 'dark' | 'system';
type ColorScheme = 'blue' | 'purple' | 'green' | 'orange';

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: {
    bg: string;
    content: string;
  };
}

interface ColorOption {
  name: ColorScheme;
  color: string;
  ring: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    preview: {
      bg: 'bg-white border',
      content: 'bg-gray-200',
    },
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    preview: {
      bg: 'bg-gray-900 border-gray-700',
      content: 'bg-gray-700',
    },
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    preview: {
      bg: 'bg-gradient-to-r from-white to-gray-900 border',
      content: 'bg-gray-400',
    },
  },
];

const colorSchemes: ColorOption[] = [
  { name: 'blue', color: 'bg-blue-600', ring: 'ring-blue-600' },
  { name: 'purple', color: 'bg-purple-600', ring: 'ring-purple-600' },
  { name: 'green', color: 'bg-green-600', ring: 'ring-green-600' },
  { name: 'orange', color: 'bg-orange-600', ring: 'ring-orange-600' },
];

export default function AppearanceSettingsPage(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('blue');
  const [chartUpColor, setChartUpColor] = useState('#22c55e');
  const [chartDownColor, setChartDownColor] = useState('#ef4444');
  const [gridOpacity, setGridOpacity] = useState(50);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const savedColorScheme = localStorage.getItem('colorScheme') as ColorScheme | null;
    const savedGridOpacity = localStorage.getItem('gridOpacity');
    const savedChartUpColor = localStorage.getItem('chartUpColor');
    const savedChartDownColor = localStorage.getItem('chartDownColor');

    if (savedColorScheme) setColorScheme(savedColorScheme);
    if (savedGridOpacity) setGridOpacity(parseInt(savedGridOpacity, 10));
    if (savedChartUpColor) setChartUpColor(savedChartUpColor);
    if (savedChartDownColor) setChartDownColor(savedChartDownColor);
  }, []);

  // Handle theme change
  const handleThemeChange = (newTheme: Theme): void => {
    setTheme(newTheme);
  };

  // Handle color scheme change
  const handleColorSchemeChange = (scheme: ColorScheme): void => {
    setColorScheme(scheme);
    localStorage.setItem('colorScheme', scheme);
    // Apply to document for CSS variable updates
    document.documentElement.setAttribute('data-color-scheme', scheme);
  };

  // Handle grid opacity change
  const handleGridOpacityChange = (value: number): void => {
    setGridOpacity(value);
    localStorage.setItem('gridOpacity', value.toString());
  };

  // Handle chart color changes
  const handleChartColorChange = (
    type: 'up' | 'down',
    color: string
  ): void => {
    if (type === 'up') {
      setChartUpColor(color);
      localStorage.setItem('chartUpColor', color);
    } else {
      setChartDownColor(color);
      localStorage.setItem('chartDownColor', color);
    }
  };

  if (!mounted) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6" />
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Appearance Settings
      </h2>

      {/* Theme Selection */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Theme
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select your preferred theme. Changes apply immediately.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={cn(
                  'cursor-pointer border-2 rounded-lg p-4 transition-all',
                  isSelected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div
                  className={cn(
                    'rounded-lg p-4 space-y-2',
                    option.preview.bg
                  )}
                >
                  <div className={cn('h-2 rounded w-3/4', option.preview.content)} />
                  <div className={cn('h-2 rounded w-1/2', option.preview.content)} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Color Scheme Selection */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Color Scheme
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose your accent color for buttons and highlights.
        </p>
        <div className="flex gap-3">
          {colorSchemes.map((scheme) => (
            <button
              key={scheme.name}
              type="button"
              onClick={() => handleColorSchemeChange(scheme.name)}
              className={cn(
                'w-12 h-12 rounded-full transition-transform hover:scale-110',
                scheme.color,
                colorScheme === scheme.name && 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800',
                colorScheme === scheme.name && scheme.ring
              )}
              title={scheme.name.charAt(0).toUpperCase() + scheme.name.slice(1)}
            >
              {colorScheme === scheme.name && (
                <Check className="w-5 h-5 text-white mx-auto" />
              )}
            </button>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Chart Preferences */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Chart Preferences
        </h3>

        {/* Candlestick Colors */}
        <div className="mb-6">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
            Candlestick Colors
          </Label>
          <div className="flex gap-6">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={chartUpColor}
                onChange={(e) => handleChartColorChange('up', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-200 dark:border-gray-700"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Up (Bullish)</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={chartDownColor}
                onChange={(e) => handleChartColorChange('down', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-200 dark:border-gray-700"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Down (Bearish)</span>
            </div>
          </div>
        </div>

        {/* Grid Opacity */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Grid Line Opacity
            </Label>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {gridOpacity}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={gridOpacity}
            onChange={(e) => handleGridOpacityChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Hidden</span>
            <span>Visible</span>
          </div>
        </div>
      </section>

      {/* Info Note */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          All changes are saved automatically and apply immediately across all your sessions.
        </p>
      </div>
    </div>
  );
}
