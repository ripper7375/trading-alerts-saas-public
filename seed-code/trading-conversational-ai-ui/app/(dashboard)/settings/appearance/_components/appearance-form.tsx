'use client';

import { useState } from 'react';
import { Sun, Moon, Monitor, Check, Palette } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

type Theme = 'dark' | 'light' | 'system';
type AccentScheme = 'amber' | 'emerald' | 'blue' | 'purple';

interface ThemeOption {
  value: Theme;
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

export function AppearanceForm() {
  const { t } = useLocale();
  const [theme, setTheme] = useState<Theme>('dark');
  const [accent, setAccent] = useState<AccentScheme>('amber');
  const [chartUpColor, setChartUpColor] = useState('#10b981');
  const [chartDownColor, setChartDownColor] = useState('#ef4444');
  const [gridOpacity, setGridOpacity] = useState(25);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <Palette className="h-4 w-4 text-amber-400" />{' '}
              {t(
                'Terminal Appearance & Chart Color Scheme',
                'รูปลักษณ์เทอร์มินัลและโทนสีกราฟ'
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Customise dark trading themes, accent highlights, and candlestick styles',
                'ปรับแต่งธีมการเทรดแบบมืด โทนสีไฮไลต์ และสไตล์แท่งเทียน'
              )}
            </p>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
            {t('LIVE PREVIEW', 'แสดงตัวอย่างสด')}
          </Badge>
        </div>

        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Theme Mode', 'โหมดธีม')}
          </Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
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
                          ? 'เทอร์มินัลการเทรดแบบมืด'
                          : option.label === 'Light Clean Mode'
                            ? 'โหมดสว่างสะอาดตา'
                            : 'ซิงค์ตามระบบ'
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-amber-400" />}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    {t(
                      option.description,
                      option.label === 'Dark Trading Terminal'
                        ? 'ธีมสีเข้มความคมชัดสูง เหมาะสำหรับการเทรดระยะยาว'
                        : option.label === 'Light Clean Mode'
                          ? 'อินเทอร์เฟซสว่างมองเห็นชัดเจนสำหรับการวิเคราะห์ในเวลากลางวัน'
                          : 'ปรับตามการตั้งค่าธีมของระบบปฏิบัติการโดยอัตโนมัติ'
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
            {t('Accent Color Scheme', 'โทนสีไฮไลต์')}
          </Label>
          <div className="flex items-center gap-3">
            {accentOptions.map((opt) => (
              <button
                key={opt.name}
                type="button"
                onClick={() => setAccent(opt.name)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all',
                  accent === opt.name
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
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
                      ? 'ทองแอมเบอร์'
                      : opt.name === 'emerald'
                        ? 'เขียวมรกต'
                        : opt.name === 'blue'
                          ? 'น้ำเงินไพลิน'
                          : 'ม่วงอเมทิสต์'
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* Chart Preferences */}
        <div className="space-y-4">
          <Label className="text-xs font-semibold text-slate-300">
            {t(
              'Chart Candlestick & Grid Customization',
              'การปรับแต่งแท่งเทียนและเส้นตารางกราฟ'
            )}
          </Label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
              <span className="text-xs font-medium text-slate-300">
                {t('Bullish Up Candle', 'แท่งเทียนขาขึ้น (Bullish)')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={chartUpColor}
                  onChange={(e) => setChartUpColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {chartUpColor}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
              <span className="text-xs font-medium text-slate-300">
                {t('Bearish Down Candle', 'แท่งเทียนขาลง (Bearish)')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={chartDownColor}
                  onChange={(e) => setChartDownColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="font-mono text-xs font-bold text-rose-400">
                  {chartDownColor}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">
                {t('Chart Grid Opacity', 'ความโปร่งแสงของเส้นตารางกราฟ')}
              </span>
              <span className="font-mono text-amber-300">{gridOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={gridOpacity}
              onChange={(e) => setGridOpacity(parseInt(e.target.value, 10))}
              className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            {isSaved
              ? t('Preferences Saved!', 'บันทึกการตั้งค่าแล้ว!')
              : t('Apply Appearance Settings', 'ปรับใช้การตั้งค่ารูปลักษณ์')}
          </Button>
        </div>
      </div>
    </div>
  );
}
